# Learning Module 01: AWS CDK & Project Initialization

Welcome to your first learning module! In this section, we'll cover the basics of what we're doing and why.

## What is AWS CDK?
The **AWS Cloud Development Kit (CDK)** is an open-source software development framework to define your cloud infrastructure in code and provision it through AWS CloudFormation.

Instead of clicking through the AWS Console, we write code (TypeScript in our case) to define our database, lambda functions, and APIs.

## Why TypeScript?
We use TypeScript because:
1. **Type Safety:** It helps prevent errors before they happen.
2. **Autocomplete:** Your IDE will help you find the right properties for AWS resources.

## What's happening in Phase 1?
1. **`npm init -y`**: Initializes a Node.js project.
2. **`aws-cdk-lib`**: The main library containing all AWS resource definitions.
3. **`constructs`**: The base class for all CDK components.
4. **`typescript` & `ts-node`**: Tools to compile and run our TypeScript code.
5. **`npx tsc --init`**: Creates a `tsconfig.json` to configure how TypeScript behaves.

### Next Steps
Once you've run the commands, we'll create the folder structure to separate our **Infrastructure** (where the cloud resources are defined) from our **Source Code** (where the AI logic lives).
