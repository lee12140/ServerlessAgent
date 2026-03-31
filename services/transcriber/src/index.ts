import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from "@aws-sdk/client-transcribe";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.REGION || 'eu-central-1';
const transcribe = new TranscribeClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const TABLE_NAME = process.env.TABLE_NAME!;
const TTL_SECONDS = 3600; // transcription jobs expire after 1 hour

interface TranscriberEvent {
  audio: string;
  sessionId: string;  // user session ID (for agent memory)
  jobId: string;      // unique ID provided by middleware for async tracking
}

async function storeResult(jobId: string, userSessionId: string, status: 'transcribed' | 'failed', text?: string, error?: string) {
  await dynamo.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      sessionId: `transcription#${jobId}`,
      userSessionId,
      status,
      ...(text  ? { transcript: text  } : {}),
      ...(error ? { error            } : {}),
      ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    },
  }));
}

/**
 * Transcriber Handler
 * Invoked asynchronously by Middleware. Converts Base64 audio → text
 * and stores the result in DynamoDB under key `transcription#<jobId>`.
 */
export const handler = async (event: TranscriberEvent) => {
  console.log('--- TRANSCRIBER START ---', event.jobId);

  const { audio, sessionId, jobId } = event;
  const bucketName = process.env.AUDIO_BUCKET!;
  const key = `audio/${sessionId}-${jobId}.webm`;

  try {
    // 1. Upload to S3
    console.log('Uploading audio to S3...');
    await s3.send(new PutObjectCommand({
      Bucket: bucketName, Key: key, Body: Buffer.from(audio, 'base64'), ContentType: 'audio/webm',
    }));

    const transcribeJobName = `job-${jobId}`;
    const fileUri = `s3://${bucketName}/${key}`;

    // 2. Start Transcribe Job
    console.log('Starting Transcribe job:', transcribeJobName);
    await transcribe.send(new StartTranscriptionJobCommand({
      TranscriptionJobName: transcribeJobName,
      IdentifyLanguage: true,
      Media: { MediaFileUri: fileUri },
      MediaFormat: 'webm',
      OutputBucketName: bucketName,
    }));

    // 3. Poll until complete (1s intervals, up to transcriber Lambda timeout)
    console.log('Polling for results...');
    let transcriptKey: string | undefined;
    const deadline = Date.now() + 110_000;

    while (Date.now() < deadline) {
      const status = await transcribe.send(new GetTranscriptionJobCommand({
        TranscriptionJobName: transcribeJobName,
      }));

      const jobStatus = status.TranscriptionJob?.TranscriptionJobStatus;
      if (jobStatus === 'COMPLETED') {
        const uri = status.TranscriptionJob?.Transcript?.TranscriptFileUri;
        if (!uri) throw new Error('Transcription completed but URI is missing');
        transcriptKey = uri.split(`${bucketName}/`)[1];
        break;
      } else if (jobStatus === 'FAILED') {
        throw new Error(`Transcribe failed: ${status.TranscriptionJob?.FailureReason}`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!transcriptKey) throw new Error('Transcription timed out after 110s');

    // 4. Fetch the transcript text from S3
    console.log('Fetching transcript from S3...');
    const getObj = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: transcriptKey }));
    const bodyContents = await getObj.Body?.transformToString();
    const data = JSON.parse(bodyContents || '{}');
    const text: string = data?.results?.transcripts?.[0]?.transcript ?? '';

    if (!text) throw new Error('Transcription returned an empty transcript');

    console.log('Transcription successful:', text);
    await storeResult(jobId, sessionId, 'transcribed', text);

  } catch (error: any) {
    console.error('Transcriber error:', error.message);
    await storeResult(jobId, sessionId, 'failed', undefined, error.message);
  }
};
