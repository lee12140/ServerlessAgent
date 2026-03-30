import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from "@aws-sdk/client-transcribe";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const REGION = process.env.REGION || 'eu-central-1';
const transcribe = new TranscribeClient({ region: REGION });
const s3 = new S3Client({ region: REGION });

interface TranscriberEvent {
    audio: string;
    sessionId: string;
}

/**
 * Transcriber Handler
 * Specialist: Converts Audio (Base64) -> Text.
 * Receives: { audio: string (base64), sessionId: string }
 */
export const handler = async (event: TranscriberEvent) => {
    console.log('--- EAR SERVICE START ---');

    const { audio, sessionId } = event;
    const bucketName = process.env.AUDIO_BUCKET!;
    const key = `audio/${sessionId}-${Date.now()}.webm`;

    // 1. Upload to S3
    console.log('Uploading audio to S3...');
    const audioBuffer = Buffer.from(audio, 'base64');
    await s3.send(new PutObjectCommand({
        Bucket: bucketName, Key: key, Body: audioBuffer, ContentType: 'audio/webm',
    }));

    const jobName = `job-${sessionId}-${Date.now()}`;
    const fileUri = `s3://${bucketName}/${key}`;

    // 2. Start Transcribe Job (auto-detect language)
    console.log('Starting Transcribe job:', jobName);
    await transcribe.send(new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        IdentifyLanguage: true,
        Media: { MediaFileUri: fileUri },
        MediaFormat: 'webm',
        OutputBucketName: bucketName,
    }));

    // 3. Poll until complete (1s intervals, 110s max)
    console.log('Polling for results...');
    let transcriptKey: string | undefined;
    const deadline = Date.now() + 110_000;

    while (Date.now() < deadline) {
        const status = await transcribe.send(new GetTranscriptionJobCommand({
            TranscriptionJobName: jobName,
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

    if (!transcriptKey) throw new Error('Transcription timed out');

    // 4. Fetch the transcript text from S3
    console.log('Fetching transcript from S3...');
    const getObj = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: transcriptKey }));
    const bodyContents = await getObj.Body?.transformToString();
    const data = JSON.parse(bodyContents || '{}');
    const text: string = data?.results?.transcripts?.[0]?.transcript ?? '';

    if (!text) throw new Error('Transcription returned an empty transcript');

    console.log('Transcription successful:', text);
    return { text };
};
