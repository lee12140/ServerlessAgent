/**
 * Local Test Script for Serverless Agent
 * Run this to test reasoning and tools without deploying to AWS.
 */
import 'dotenv/config';
import { runAgentTurn } from './agent.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Manually load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Configuration
const sessionId = 'test-session-' + Date.now();
const testMessage = process.argv[2] || "Hello! What time is it and can you schedule a test meeting for tomorrow at 10 AM?";

console.log(`\n--- 🚀 Starting Local Agent Test ---`);
console.log(`Session: ${sessionId}`);
console.log(`Message: "${testMessage}"\n`);

async function runTest() {
    try {
        // Ensure necessary env vars are set for local run
        // Set TABLE_NAME in your .env file — find the value in the CDK deploy output
        if (!process.env.TABLE_NAME) throw new Error('TABLE_NAME is not set. Add it to your .env file.');
        process.env.REGION = process.env.REGION || 'eu-central-1';

        const response = await runAgentTurn(sessionId, testMessage);
        
        console.log(`\n--- 🤖 Agent Response ---`);
        console.log(response);
        console.log(`\n--- ✅ Test Complete ---\n`);
    } catch (error) {
        console.error(`\n--- ❌ Test Failed ---`);
        console.error(error);
    }
}

runTest();
