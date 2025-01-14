/*
 * Copyright © 2024 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import { InfluxDB, Point } from "@influxdata/influxdb-client";
import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import slug from "slug";

import { BotStatsType } from "@/analytics/schemas/bot-stats.schema";
import EventWrapper from "@/channel/lib/EventWrapper";
import { BlockFull } from "@/chat/schemas/block.schema";
import { Subscriber } from "@/chat/schemas/subscriber.schema";
import { Context } from "@/chat/schemas/types/context";
import { OutgoingMessage } from "@/chat/schemas/types/message";
import { HelperService } from "@/helper/helper.service";
import BaseHelper from "@/helper/lib/base-helper";
import { HelperType } from "@/helper/types";
import { LoggerService } from "@/logger/logger.service";
import { Setting } from "@/setting/schemas/setting.schema";
import { SettingService } from "@/setting/services/setting.service";

import { INFLUXDB_HELPER_NAME } from "./settings";
import { InfluxFields, InfluxTags } from "./types";

@Injectable()
export default class InfluxdbHelper
  extends BaseHelper<typeof INFLUXDB_HELPER_NAME>
  implements OnApplicationBootstrap
{
  protected readonly type: HelperType = HelperType.UTIL;

  private client: InfluxDB;

  constructor(
    settingService: SettingService,
    helperService: HelperService,
    logger: LoggerService
  ) {
    super(INFLUXDB_HELPER_NAME, settingService, helperService, logger);
  }

  getPath(): string {
    return __dirname;
  }

  async onApplicationBootstrap() {
    const settings = await this.getSettings();

    this.client = new InfluxDB({
      url: settings.url,
      token: settings.token,
    });
  }

  @OnEvent("hook:influxdb_helper:url")
  async handleApiUrlChange(setting: Setting) {
    const settings = await this.getSettings();

    this.client = new InfluxDB({
      url: setting.value,
      token: settings.token,
    });
  }

  @OnEvent("hook:influxdb_helper:token")
  async handleApiTokenChange(setting: Setting) {
    const settings = await this.getSettings();

    this.client = new InfluxDB({
      url: settings.url,
      token: setting.value,
    });
  }

  /**
   * Get language iso code from the subscriber object when found, otherwise from the language nlp entity.
   *
   * @param event - Channel event
   *
   * @returns Subscriber's language
   */
  private getLanguage(event: EventWrapper<any, any>) {
    const subscriber = event.getSender();
    let language: string | null = null;
    const nlp = event.getNLP();
    if (!!nlp && !!nlp.entities) {
      const entityLanguage = nlp.entities.find(
        (entity) => entity.entity === "language"
      );
      if (entityLanguage) {
        language = entityLanguage.value;
      }
    }
    if (!language && subscriber) {
      language = subscriber.language;
    }
    return language;
  }

  /**
   * Builds a dictionnary of tags (language, nlp, ...)
   *
   * @param event - Channel event
   *
   * @returns Dictionnary of tags
   */
  private getMessageTags(event: EventWrapper<any, any>) {
    let tagsMap: { [tag: string]: string } = {
      language: this.getLanguage(event) || "unknown",
    };
    // Populate tags with nlp entities/values (except language)
    const nlp = event.getNLP();
    if (nlp && nlp.entities) {
      tagsMap = nlp.entities
        .filter((a) => !!a.entity && !!a.value && a.entity !== "language")
        .reduce((acc, a) => {
          acc[a.entity] = a.value;
          return acc;
        }, tagsMap);
    }
    // Returns tags as an array of strings
    return tagsMap;
  }

  /**
   * Constructs a structured object of InfluxDB fields from a given subscriber object.
   * This method maps subscriber information into a format suitable for InfluxDB insertion,
   * organizing key subscriber details into field objects with designated value types.
   *
   * @param subscriber - The subscriber object containing essential information.
   *
   * @returns An object representing the InfluxDB fields, each containing the type of the field and its value.
   */
  private getSubscriberFields({
    id,
    foreign_id,
    first_name,
    last_name,
  }: Subscriber): InfluxFields {
    return {
      recipient: {
        type: "string",
        value: id,
      },
      foreign_id: {
        type: "string",
        value: foreign_id,
      },
      first_name: {
        type: "string",
        value: first_name,
      },
      last_name: {
        type: "string",
        value: last_name,
      },
    };
  }

  /**
   * Constructs a structured object of InfluxDB fields from an event, block, and optional context.
   * This method extracts necessary information from an event and block, formatting it into a
   * suitable structure for InfluxDB insertion. It includes handling of event payloads, block metadata,
   * and contextual data like attempt count.
   *
   * @param event - The event object that may contain a payload to be processed. Can be null.
   * @param block - The block object containing block-specific information such as name and whether it starts a conversation.
   * @param context - Optional context object providing additional details like attempt count.
   *
   * @returns An object representing the InfluxDB fields, encapsulating data such as the block name, event payload,
   * and attempt number, structured for database entry.
   */
  private getBlockFields(
    event: EventWrapper<any, any> | null,
    block: BlockFull,
    context?: Context
  ): InfluxFields {
    const payload = event && event.getPayload();
    const postback =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    return {
      block: {
        type: "string",
        value: slug(block.name, " "),
      },
      postback: {
        type: "string",
        value: postback,
      },
      attempt: {
        type: "int",
        value: context && context.attempt ? context.attempt : 0,
      },
      start: {
        type: "boolean",
        value: block && block.starts_conversation,
      },
    };
  }

  /**
   * Constructs a structured object of InfluxDB fields from a map of extra fields.
   * This method processes a key-value map where each value's data type determines how it
   * should be represented in InfluxDB. Special handling is applied for strings, numbers, booleans,
   * and objects (serialized as JSON strings).
   *
   * @param extraFields - A map where keys are field names and values are the data to be stored in those fields.
   *
   * @returns An object representing the InfluxDB fields, each encapsulating the type and value of the field,
   * structured appropriately for database entry.
   */
  private getPluginFields(extraFields: { [key: string]: any }): InfluxFields {
    return Object.keys(extraFields).reduce((acc, key) => {
      let value = extraFields[key];
      let type: string | null = null;
      if (typeof value === "string") {
        type = "string";
      } else if (typeof value === "number") {
        type = "float";
      } else if (typeof value === "boolean") {
        type = "boolean";
      } else if (typeof value === "object") {
        // like an error object for example
        type = "string";
        value = JSON.stringify(value);
      }
      return type
        ? {
            ...acc,
            [key]: {
              type,
              value,
            },
          }
        : acc;
    }, {});
  }

  /**
   * Determines the subject for a given block based on its name. This method uses a regular expression
   * constructed from predefined subjects to extract a relevant subject from the block name. If no
   * matching subject is found, a default subject is assigned. Subjects are used to group specfic
   * blocks related to a given subject.
   *
   * @param blockName - The name of the block from which to derive the subject.
   *
   * @returns The determined subject for the block. If no explicit match is found, a default subject is returned.
   */
  private async getBlockSubject(blockName: string) {
    const { subjects, default_subject } = await this.getSettings();
    const subjectsExp = new RegExp(`.*(${subjects.join("|")}).*`);
    let subject = blockName.replace(subjectsExp, (str, caught) => caught);
    if (subjects.indexOf(subject) === -1) {
      subject = default_subject;
    }
    return subject;
  }

  /**
   * Logs an event to InfluxDB with specified name, value, tags, and additional fields.
   * This method constructs a data point for InfluxDB, assigns a main floating point value,
   * adds any additional fields based on their types, tags the data for better aggregation,
   * and finally writes the point to InfluxDB. Errors in logging are handled gracefully and logged.
   *
   * @param name - The name of the event or measurement.
   * @param value - The main numeric value associated with the event, used for aggregation calculations.
   * @param tags - A collection of tags associated with the event for indexing and query efficiency.
   * @param fields - A collection of additional data fields, each having a type and value, to be included with the event.
   *
   * @returns A promise resolved with the result of the InfluxDB write operation or rejected with an error if the write fails.
   */
  public async logEvent(
    name: string,
    value: number,
    tags: InfluxTags,
    fields: InfluxFields
  ) {
    const { organization, bucket } = await this.getSettings();
    const iWrite = this.client.getWriteApi(organization, bucket, "ns");

    // Create measure name
    const point = new Point(name);

    // Set value, 1 as count value, others for avg, sum, ...
    point.floatField("value", value);

    // Add extra fields
    Object.entries(fields)
      .filter(([, { value }]) => !!value)
      .forEach(([key, { type, value }]) => {
        point[`${type}Field`](key, value);
      });

    // Add tags for aggregations
    Object.entries(tags)
      .filter(([, value]) => !!value)
      .forEach(([key, value]) => {
        point.tag(key, value);
      });

    // Track event (send it to influxdb)
    try {
      iWrite.writePoint(point);
      const res = await iWrite.close();
      this.logger.debug("InfluxDB Service: Successfully logged: ", name);
      return res;
    } catch (err) {
      this.logger.error("InfluxDB Service: Error sending analytic event", err);
    }
  }

  /**
   * Logs a "message sent" event with relevant subscriber details and event information.
   * This method retrieves the sender from the event, constructs appropriate tags and fields,
   * and then logs this event using a central logging function. Tags include channel and event type,
   * and fields are derived from the subscriber's details.
   *
   * @param event - The event wrapper object containing details about the message and sender.
   *
   * @returns A promise representing the asynchronous logging operation, resolved when the event is successfully logged.
   */
  private logMessageSentEvent(event: EventWrapper<any, any>) {
    const subscriber = event.getSender();
    const tags = {
      ...this.getMessageTags(event),
      channel: event._handler.getName() || "unknown",
      type: "message",
    };
    const fields = this.getSubscriberFields(subscriber);
    return this.logEvent(
      `Event - ${slug("Message sent", " ")}`,
      1,
      tags,
      fields
    );
  }

  /**
   * Logs a "message received" event with detailed subscriber information and event specifics.
   * This method gathers the sender from the event, compiles tags including the communication channel and event type,
   * and retrieves additional subscriber fields. It uses a centralized logging function to record the event in an
   * analytics or monitoring system.
   *
   * @param event - The event wrapper object that encapsulates details about the received message and its sender.
   *
   * @returns A promise representing the asynchronous operation of logging the event, resolved when the logging is successfully completed.
   */
  private logMessageReceivedEvent(event: EventWrapper<any, any>) {
    const subscriber = event.getSender();
    const tags = {
      ...this.getMessageTags(event),
      channel: event._handler.getName() || "unknown",
      type: "message",
    };
    const fields = this.getSubscriberFields(subscriber);
    return this.logEvent(
      `Event - ${slug("Message received", " ")}`,
      1,
      tags,
      fields
    );
  }

  /**
   * Logs a "block" event, capturing when a specific block gets triggered, along with detailed subscriber and contextual information.
   * This method extracts the subscriber who triggered the event and constructs both tags and fields to record extensive details.
   * Tags include the communication channel, event type, and the subject derived from the block name. Fields combine subscriber details
   * with block-specific and contextual data.
   *
   * @param event - The event wrapper containing details about the event and its initiator.
   * @param block - The block object related to the event, containing information like the block name.
   * @param context - Additional contextual information relevant to the event, such as the current state or user interactions.
   *
   * @returns A promise representing the asynchronous operation of logging the event, resolved when the event logging is successfully completed.
   */
  private async logBlockEvent(
    event: EventWrapper<any, any>,
    block: BlockFull,
    context: Context
  ) {
    const subscriber = event.getSender();
    const tags = {
      ...this.getMessageTags(event),
      channel: event._handler.getName() || "unknown",
      type: "block",
      subject: await this.getBlockSubject(block.name),
    };
    const fields: InfluxFields = {
      ...this.getSubscriberFields(subscriber),
      ...this.getBlockFields(event, block, context),
    };
    return this.logEvent(`Block`, 1, tags, fields);
  }

  /**
   * Logs an event indicating either a handover or handback of control, depending on the given boolean flag.
   * This function creates tags and fields to be sent to a logging mechanism, identifying the nature of the event
   * (either 'Handover' or 'Handback') and including detailed subscriber information.
   *
   * @param subscriber - The subscriber object whose details are logged along with the event.
   * @param isHandover - A boolean flag determining whether the event is a handover (true) or handback (false).
   *
   * @returns A promise representing the asynchronous operation of logging the event, resolved when the logging is completed.
   */
  private logHandoverEvent(subscriber: Subscriber, isHandover: boolean) {
    const tags = {
      channel: subscriber.channel && subscriber.channel.name,
      type: "passation",
    };
    const fields = this.getSubscriberFields(subscriber);
    return this.logEvent(
      `${isHandover ? "Handover" : "Handback"}`,
      1,
      tags,
      fields
    );
  }

  /**
   * Logs a event when standard processing block paths fail, distinguishing between local and global fallbacks.
   * This method extracts subscriber details and constructs tags and fields for logging. The nature of the fallback
   * (local or global) is determined based on the presence of a block. Local fallbacks relate to specific blocks,
   * while global fallbacks occur at a broader level.
   *
   * @param event - The event wrapper containing details about the event and its initiator.
   * @param block - Optional. The block object associated with the fallback, if it is local.
   * @param context - Optional. Contextual information relevant to the event and block, used for additional logging details.
   *
   * @returns A promise representing the asynchronous operation of logging the event, resolved when the logging is successfully completed.
   */
  private logFallbackEvent(
    event: EventWrapper<any, any>,
    block?: BlockFull,
    context?: Context
  ) {
    const subscriber = event.getSender();
    const tags = {
      ...this.getMessageTags(event),
      channel: event._handler.getName() || "unknown",
      type: "fallback",
    };
    const fields = {
      ...this.getSubscriberFields(subscriber),
      ...(block ? this.getBlockFields(event, block, context) : {}),
    };
    return this.logEvent(
      `${block ? "Local Fallback" : "Global Fallback"}`,
      1,
      tags,
      fields
    );
  }

  /**
   * Logs an intervention event for a subscriber, capturing when the intervention was assigned and opened.
   * This method checks if the subscriber was previously assigned an intervention and if so, calculates the delay
   * between the time the intervention was assigned and when it was opened. The event logs detailed timestamps
   * and delays in multiple time units (seconds, minutes, hours) for comprehensive analysis.
   *
   * @param subscriber - The subscriber object detailing who the intervention pertains to and when it was assigned.
   *
   * @returns A promise representing the asynchronous operation of logging the event, resolved when the logging is successfully completed,
   *          or undefined if the subscriber was not assigned an intervention.
   */
  private logInterventionEvent(subscriber: Subscriber) {
    if (
      subscriber &&
      subscriber.assignedAt &&
      subscriber.assignedAt.getTime() > 0
    ) {
      const tags = {
        channel: subscriber.channel && subscriber.channel.name,
        type: "intervention",
      };
      const currentDatetime = new Date();
      const delay = Math.abs(
        currentDatetime.getTime() - subscriber.assignedAt.getTime()
      );

      const fields: InfluxFields = {
        ...this.getSubscriberFields(subscriber),
        assigned_at: {
          type: "string",
          value: subscriber.assignedAt.toString(),
        },
        assigned_at_ts: {
          type: "int",
          value: subscriber.assignedAt.getTime(),
        },
        intervention_opened_at: {
          type: "string",
          value: currentDatetime.toString(),
        },
        intervention_opened_at_ts: {
          type: "int",
          value: currentDatetime.getTime(),
        },
        intervention_delay_sec: {
          type: "float",
          value: delay / 1000,
        },
        intervention_delay_min: {
          type: "float",
          value: delay / (60 * 1000),
        },
        intervention_delay_hour: {
          type: "float",
          value: delay / (60 * 60 * 1000),
        },
      };
      return this.logEvent(
        "Intervention Opened",
        delay / (60 * 1000), // in minutes
        tags,
        fields
      );
    }
  }

  /**
   * Logs an event related to the execution of a plugin block, capturing extensive details about
   * the block in which it was executed, and the user context. This method constructs tags and fields
   * that include specific information about the plugin, user, and contextual attributes, along with any
   * additional fields provided.
   *
   * @param pluginTitle - The title of the plugin being logged.
   * @param block - The block object associated with the event, which may include additional contextual details.
   * @param context - The context in which the event occurs, containing user and channel information.
   * @param extraFields - A map of additional fields that provide further details specific to the plugin event.
   *
   * @returns A promise representing the asynchronous operation of logging the event, resolved when the logging is completed.
   */
  public logPluginEvent(
    pluginTitle: string,
    block: BlockFull,
    context: Context,
    extraFields: { [key: string]: any }
  ) {
    const subscriber = context.user;
    const tags = {
      channel: context && context.channel ? context.channel : "unknown",
      type: "plugin",
    };
    const fields: InfluxFields = {
      ...this.getSubscriberFields(subscriber),
      ...this.getBlockFields(null, block, context),
      plugin: {
        type: "string",
        value: pluginTitle,
      },
      ...this.getPluginFields(extraFields),
    };
    return this.logEvent(`Plugin`, 1, tags, fields);
  }

  /**
   * Logs an insight event for the bot, capturing essential details about the type of event and subscriber information.
   * This method tags the event with the channel, event name, and type, while also gathering comprehensive subscriber
   * details to log as fields. It's designed to help in analyzing various metrics related to bot interactions.
   *
   * @param type - The type of insight event, categorized by BotStatsType.
   * @param name - The name of the insight event, providing a specific identifier for the type of data being logged.
   * @param subscriber - The subscriber object, containing details such as the channel name.
   *
   * @returns A promise representing the asynchronous operation of logging the event, resolved when the logging is successfully completed.
   */
  public logStatEvent(
    type: BotStatsType,
    name: string,
    subscriber: Subscriber
  ) {
    const tags = {
      channel: subscriber.channel && subscriber.channel.name,
      name,
      type,
    };
    const fields = this.getSubscriberFields(subscriber);
    return this.logEvent(`Stats`, 1, tags, fields);
  }

  @OnEvent("hook:chatbot:sent")
  handleMessageSent(_sent: OutgoingMessage, event: EventWrapper<any, any>) {
    if (event) {
      this.logMessageSentEvent(event);
    }
  }

  @OnEvent("hook:chatbot:received")
  handleMessageReceived(event: EventWrapper<any, any>) {
    if (event) {
      this.logMessageReceivedEvent(event);
    }
  }

  @OnEvent("hook:analytics:block")
  handleBlockTrigger(
    block: BlockFull,
    event: EventWrapper<any, any>,
    context: Context
  ) {
    if (event && block && block.name) {
      this.logBlockEvent(event, block, context);
    }
  }

  @OnEvent("hook:analytics:passation")
  handleHandover(subscriber: Subscriber, isHandover: boolean) {
    if (subscriber) {
      this.logHandoverEvent(subscriber, isHandover);
    }
  }

  @OnEvent("hook:analytics:fallback-global")
  handleGlobalFallback(event) {
    if (event) {
      this.logFallbackEvent(event);
    }
  }

  @OnEvent("hook:analytics:fallback-local")
  handleLocalFallback(
    block: BlockFull,
    event: EventWrapper<any, any>,
    context: Context
  ) {
    if (event) {
      this.logFallbackEvent(event, block, context);
    }
  }

  @OnEvent("hook:analytics:intervention")
  handleNewIntervention(subscriber: Subscriber) {
    if (subscriber) {
      this.logInterventionEvent(subscriber);
    }
  }

  @OnEvent("hook:stats:entry")
  handleStatEntry(type: BotStatsType, name: string, subscriber: Subscriber) {
    switch (type) {
      case BotStatsType.new_users:
      case BotStatsType.returning_users:
        if (subscriber) {
          // Not all of the 'hook:stats:entry' events do not pass the subscriber in args (yet)
          this.logStatEvent(type, name, subscriber);
        }
        break;
      default:
        // Do nothing
        break;
    }
  }
}
