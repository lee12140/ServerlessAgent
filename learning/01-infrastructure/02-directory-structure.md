# Learning Module 02: The Anatomy of a Serverless Project

Now that we have our tools installed, let's organize our workspace. A clean project structure makes it much easier to maintain and scale your AI agent.

## Why this structure?
We are splitting our project into three main areas:

### 1. The Infrastructure (`/infra`)
This is where the "Blueprint" of your cloud environment lives. 
- `infra/bin`: The entry point for the CDK. This is the script that "starts" the deployment.
- `infra/lib`: Where the actual resource definitions (Stacks) live. For example, your database stack and your API stack.

### 2. The Source Code (`/src`)
This is the "Brain" of your agent. 
- `src/handlers`: The entry points for your Lambda functions. When an API request comes in, AWS calls one of these handlers.
- `src/skills`: The specific tools your AI can use (e.g., searching the web, sending emails).
- `src/memory`: How your AI remembers past conversations (using DynamoDB).

### 3. The Container (`/docker`)
Since we are using **Lambda Container Images**, we need a `Dockerfile`. This file tells AWS how to build the "box" that our code runs in.

## Commands to run
You can create all these folders at once! In your terminal, run:

```powershell
mkdir -p infra/bin, infra/lib, src/handlers, src/skills, src/memory, docker
```
*(Wait, on Windows PowerShell, the syntax is a bit different if you want to do it in one go, but simple `mkdir` works for single folders too.)*

For Windows PowerShell:
```powershell
New-Item -ItemType Directory -Path infra/bin, infra/lib, src/handlers, src/skills, src/memory, docker
```
