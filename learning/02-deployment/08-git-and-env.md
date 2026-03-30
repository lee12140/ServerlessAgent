# Learning Module 08: Keeping it Clean (Git & Environment)

Before we deploy, we need to make sure we don't accidentally share our secrets or "garbage" files with the world.

## The `.gitignore` File
You just created a `.gitignore` file. Here's what it does:
- **`node_modules/`**: No need to save these; anyone can re-install them with `npm install`.
- **`cdk.out/`**: This is a temporary folder that CDK uses to prepare your deployment.
- **`.env`**: **CRITICAL!** This is where you will eventually put your API keys (Telegram, OpenAI, etc.). You must NEVER share this file.

## Why use `.env.example`?
Since we ignore the real `.env` file, we create an `.env.example` file to tell other developers (or your future self) what keys are needed.

### Next Step
We are almost there! The very last thing we need before deployment is the `cdk.json` file, which tells the CDK tool how to run your code.
