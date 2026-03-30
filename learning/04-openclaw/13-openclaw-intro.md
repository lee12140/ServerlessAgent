# Module 13: What is OpenClaw? 🦾

OpenClaw is an open-source, autonomous AI agent framework written in TypeScript. It is one of the fastest-growing open-source projects ever (214k+ GitHub stars in just a few months).

## How it's different from a "chatbot"

| Chatbot | OpenClaw Agent |
|---|---|
| Answers questions | Executes real tasks |
| Stateless | Has persistent memory |
| Single LLM call per message | Multi-step reasoning + tool use |
| Reads text | Reads files, browses web, sends emails |

## The Core Idea: ReAct Loop
OpenClaw uses a **ReAct (Reason + Act)** loop:
1. **Think:** The LLM decides what to do
2. **Act:** It calls a "Skill" (tool)
3. **Observe:** It reads the result
4. **Repeat** until the task is done

## The Problem with Serverless
By default, OpenClaw runs as an always-on background process.
Lambda **shuts down after each request**, so we need our **Stateless Adapter** (Module 14) to fix this.

## Our Solution
We keep OpenClaw's brain (the ReAct reasoning) but replace its memory with **DynamoDB** — which IS persistent across requests.
