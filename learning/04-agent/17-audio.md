# Module 17: Giving Your Agent "Ears" 🎙️👂

## The Challenge
Most AI models (like Nova or Claude) cannot "hear" audio files directly in real-time. To give our agent ears, we need a translation layer: **Amazon Transcribe**.

---

## 🏗️ The Step-by-Step Architecture

1. **The Recording:** Your Web Component records your voice and sends it as an audio blob.
2. **The "Waiting Room" (S3):** Lambda receives the blob and uploads it to a private S3 bucket.
3. **The Translator (Transcribe):** Lambda tells Amazon Transcribe: *"Hey, look at this file in S3 and tell me what they said."*
4. **The Brain:** Once Transcribe is done, the Lambda sends the text to the Agent as if you typed it.

---

## ✏️ Step 1: Add the S3 "Waiting Room"

Open `infra/lib/db-stack.ts` and add the bucket:

```typescript
import * as s3 from 'aws-cdk-lib/aws-s3';

// Inside the constructor
this.audioBucket = new s3.Bucket(this, 'AudioBucket', {
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    lifecycleRules: [{ expiration: cdk.Duration.days(1) }] // Clean up every 24h
});
```

---

## ✏️ Step 2: Grant Ears & Storage to the Brain

Open `infra/lib/lambda-stack.ts` and add these permissions:

```typescript
// Grant S3 access
this.handler.addToRolePolicy(new iam.PolicyStatement({
    actions: ['s3:PutObject', 's3:GetObject'],
    resources: ['*'] 
}));

// Grant Transcribe access
this.handler.addToRolePolicy(new iam.PolicyStatement({
    actions: ['transcribe:StartTranscriptionJob', 'transcribe:GetTranscriptionJob'],
    resources: ['*']
}));
```

---

## ✏️ Step 3: The Record Button (UI)

We'll add a 🎙️ button to our Web Component. It will use the browser's `MediaRecorder` API to capture your audio.

✅ **Concept Ready!** Next we'll implement the infrastructure changes.

➡️ **Next: [Module 18 — Implementing the Audio Pipeline](./18-audio-logic.md)**
