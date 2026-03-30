# Module 11: The First Thought (Calling Bedrock) 🧠

Your agent now has a "Voice box" (permissions). Now it needs a "Brain." While Nova Micro is the cheapest, for a **great all-rounder** that is smart enough to follow complex agent instructions, we recommend **Claude 3.5 Sonnet**. It is the gold standard for AI agents right now.

## 📦 1. Install the SDK
Before we can write the code, we need the library that talks to Bedrock. Run this in your terminal:

```powershell
npm install @aws-sdk/client-bedrock-runtime
```

## 🧠 2. Update the Handler
We'll use the modern `Converse` API. Open `src/handlers/index.ts` and replace its contents with this:


```typescript
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'eu-central-1' });

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // 1. Get the user message
    const body = event.body ? JSON.parse(event.body) : {};
    const userMessage = body.message || "Hello!";

    // 2. Prepare the request for Claude 3.5 Sonnet (The All-Rounder!)
    const command = new ConverseCommand({
        modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0', 
        messages: [
            {
                role: 'user',
                content: [{ text: userMessage }],
            },
        ],
        inferenceConfig: {
            maxTokens: 1000,
            temperature: 0.7,
        },
    });

    try {
        // 3. Call the AI!
        const response = await client.send(command);
        
        // Extract the text from the response
        const aiText = response.output?.message?.content?.[0]?.text || "I have no words.";

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: aiText,
                input: userMessage
            }),
        };
    } catch (error) {
        console.error('AI Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'The AI is having a headache.' }),
        };
    }
};
```

## 🚀 3. Deploy
Rebuild your Docker image and update the Lambda:

```powershell
npx cdk deploy OpenClawLambdaStack
```

---
### ⚠️ One Important Check!
You MUST go to the [**AWS Bedrock Console**](https://eu-central-1.console.aws.amazon.com/bedrock/home?region=eu-central-1#/modelaccess) and click **"Edit"** -> **"Request Access"** for **Amazon Nova Micro**. 

*Once access is granted and you've deployed, your bot will start talking for pennies!*
