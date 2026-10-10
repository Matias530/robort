# Bot de Discord - Plantilla

Este proyecto es una plantilla básica para crear un bot de Discord con `discord.js`.

## Requisitos

- Node.js 18 o superior
- Un bot creado en el [Portal de Desarrolladores de Discord](https://discord.com/developers/applications)

## Instalación

1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta:

```bash
npm install
```

3. Crea un archivo `.env` basado en `.env.example`:

```env
DISCORD_TOKEN=tu_token_aqui
CLIENT_ID=tu_client_id_aqui
GUILD_ID=tu_guild_id_aqui
```

## Registro de comandos

Para registrar los comandos slash del bot en tu servidor:

```bash
npm run deploy
```

## Ejecutar el bot

```bash
npm start
```

## Estructura

- `src/index.js`: inicia el bot
- `src/deploy-commands.js`: registra los comandos
- `src/commands/`: comandos del bot

## Comandos incluidos

- `/ping`
- `/help`
- `/play <url o texto>`

## Personalización

Puedes agregar más comandos en la carpeta `src/commands` siguiendo el ejemplo de `ping.js`.
