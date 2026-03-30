# 📚 Learning Modules

This folder contains step-by-step learning modules for the Serverless Serverless Agent project.

## 01-infrastructure — CDK & Cloud Resources
| Module | Topic |
|---|---|
| [01-cdk-basics.md](./01-infrastructure/01-cdk-basics.md) | What is AWS CDK? |
| [02-directory-structure.md](./01-infrastructure/02-directory-structure.md) | Project layout |
| [03-dynamodb-stack.md](./01-infrastructure/03-dynamodb-stack.md) | Session database |
| [04-api-stack.md](./01-infrastructure/04-api-stack.md) | API Gateway webhook |
| [05-lambda-stack.md](./01-infrastructure/05-lambda-stack.md) | Lambda container |
| [06-main-entry-point.md](./01-infrastructure/06-main-entry-point.md) | Wiring stacks together |

## 02-deployment — Docker & AWS
| Module | Topic |
|---|---|
| [07-docker-and-logic.md](./02-deployment/07-docker-and-logic.md) | Dockerfile setup |
| [08-git-and-env.md](./02-deployment/08-git-and-env.md) | Git & environment |
| [09-deployment.md](./02-deployment/09-deployment.md) | `cdk deploy` |

## 03-ai-brain — Bedrock & Memory
| Module | Topic |
|---|---|
| [10-permissions.md](./03-ai-brain/10-permissions.md) | IAM for Bedrock |
| [11-calling-bedrock.md](./03-ai-brain/11-calling-bedrock.md) | First LLM call |
| [12-session-memory.md](./03-ai-brain/12-session-memory.md) | DynamoDB memory |

## 04-agent — Stateless Serverless Agent Integration *(Next)*
| Module | Topic |
|---|---|
| [13-agent-intro.md](./04-agent/13-agent-intro.md) | What is a ReAct Agent? |
| [14-stateless-adapter.md](./04-agent/14-stateless-adapter.md) | The core adapter pattern |
| [15-skills.md](./04-agent/15-skills.md) | Building Skills |
| [16-webhooks.md](./04-agent/16-webhooks.md) | Telegram/Discord integration |
