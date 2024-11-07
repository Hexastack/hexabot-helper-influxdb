# hexabot-helper-influxdb

InfluxDB Hexabot Helper Extension for Advanced Analytics

[Hexabot](https://hexabot.ai/) is an open-source chatbot / agent solution that allows users to create and manage AI-powered, multi-channel, and multilingual chatbots with ease. If you would like to learn more, please visit the [official github repo](https://github.com/Hexastack/Hexabot/).

## Advantages

- Fast: Handles large amounts of data efficiently.
- Scalable: Grows with your needs.
- Time Series Focused: Makes analyzing timestamps a breeze.

## Config

- Docker compose example

```
influxdb:
    container_name: influxdb
    image: influxdb:2.0
    volumes:
      - influxdb-data:/var/lib/influxdb2:rw
      - influxdb-config:/etc/influxdb2
    environment:
      - DOCKER_INFLUXDB_INIT_MODE=${INFLUXDB_INIT_MODE}
      - DOCKER_INFLUXDB_INIT_USERNAME=${INFLUXDB_INIT_USERNAME}
      - DOCKER_INFLUXDB_INIT_PASSWORD=${INFLUXDB_INIT_PASSWORD}
      - DOCKER_INFLUXDB_INIT_ORG=${INFLUXDB_INIT_ORG}
      - DOCKER_INFLUXDB_INIT_BUCKET=${INFLUXDB_INIT_BUCKET}
      - DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=${INFLUXDB_INIT_ADMIN_TOKEN}
    networks:
      - influxdb-network
    ports:
      - '8086:8086'
      - ${APP_INFLUXDB_PORT}:8086
    healthcheck:
      test: "curl -f http://localhost:8086/ping"
      interval: 5s
      timeout: 10s
      retries: 5

volumes:
  influxdb-data:
  influxdb-config:

networks:
  influxdb-network:
```

## Installation

First, navigate to your Hexabot project directory and make sure the dependencies are installed:

```sh
cd ~/projects/my-chatbot
npm install hexabot-helper-influxdb
hexabot dev
```

## Contributing

We welcome contributions from the community! Whether you want to report a bug, suggest new features, or submit a pull request, your input is valuable to us.

Please refer to our contribution policy first : [How to contribute to Hexabot](https://github.com/Hexastack/Hexabot/blob/main/CONTRIBUTING.md)

[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://github.com/Hexastack/Hexabot/blob/main/CODE_OF_CONDUCT.md)

Feel free to join us on [Discord](https://discord.gg/rNb9t2MFkG)

## License

This software is licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:

---

_Happy Chatbot Building!_
