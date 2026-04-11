import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from "@aws-sdk/client-transcribe";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.REGION || 'eu-central-1';
const transcribe = new TranscribeClient({ region: REGION });
const s3         = new S3Client({ region: REGION });
const dynamo     = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const TABLE_NAME  = process.env.TABLE_NAME!;
const TTL_SECONDS = 3600;

interface TranscriberEvent {
  s3Key: string;     // audio already uploaded to S3 by middleware
  sessionId: string; // user session ID — passed through to agent
  jobId: string;     // unique ID for async status tracking
}

async function storeResult(
  jobId: string, userSessionId: string,
  status: 'transcribed' | 'failed',
  text?: string, error?: string,
) {
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
 * Polls AWS Transcribe with an initial wait and increasing interval to avoid
 * hammering the API during the mandatory startup period (~15-20s minimum).
 *
 * Schedule: wait 8s, then poll every 4s (vs. old 1s-from-the-start approach).
 * Saves ~10-15 unnecessary GetTranscriptionJob API calls per job.
 */
async function waitForTranscription(jobName: string, deadlineMs: number): Promise<string> {
  // AWS Transcribe always takes at least ~15s regardless of audio length.
  // Wait 8 seconds before the first poll.
  await new Promise(r => setTimeout(r, 8000));

  while (Date.now() < deadlineMs) {
    const status = await transcribe.send(new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName,
    }));

    const jobStatus = status.TranscriptionJob?.TranscriptionJobStatus;

    if (jobStatus === 'COMPLETED') {
      const uri = status.TranscriptionJob?.Transcript?.TranscriptFileUri;
      if (!uri) throw new Error('Transcription completed but URI is missing');
      const bucketName = process.env.AUDIO_BUCKET!;
      return uri.split(`${bucketName}/`)[1]!;
    }

    if (jobStatus === 'FAILED') {
      throw new Error(`Transcribe failed: ${status.TranscriptionJob?.FailureReason}`);
    }

    // Poll every 4s instead of every 1s
    await new Promise(r => setTimeout(r, 4000));
  }

  throw new Error('Transcription timed out');
}

/**
 * Transcriber handler — invoked asynchronously by Middleware.
 * Receives an S3 key (audio already uploaded), runs transcription,
 * stores the result in DynamoDB for the status endpoint to pick up.
 */
export const handler = async (event: TranscriberEvent) => {
  const { s3Key, sessionId, jobId } = event;
  const bucketName = process.env.AUDIO_BUCKET!;

  console.log(`Transcriber start: jobId=${jobId}, s3Key=${s3Key}`);

  try {
    const transcribeJobName = `job-${jobId}`;
    const fileUri = `s3://${bucketName}/${s3Key}`;

    // Start Transcribe job (audio is already in S3)
    await transcribe.send(new StartTranscriptionJobCommand({
      TranscriptionJobName: transcribeJobName,
      IdentifyLanguage: true,
      Media: { MediaFileUri: fileUri },
      MediaFormat: 'webm',
      OutputBucketName: bucketName,
    }));

    const deadline     = Date.now() + 110_000;
    const transcriptKey = await waitForTranscription(transcribeJobName, deadline);

    // Fetch transcript text from S3
    const getObj = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: transcriptKey }));
    const body   = await getObj.Body?.transformToString();
    const text: string = JSON.parse(body || '{}')?.results?.transcripts?.[0]?.transcript ?? '';

    if (!text) throw new Error('Transcription returned an empty transcript');

    console.log(`Transcription done: jobId=${jobId}`);
    await storeResult(jobId, sessionId, 'transcribed', text);

  } catch (error: any) {
    console.error(`Transcriber error: jobId=${jobId}`, error.message);
    await storeResult(jobId, sessionId, 'failed', undefined, error.message);
  }
};
