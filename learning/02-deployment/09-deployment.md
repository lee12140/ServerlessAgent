# Learning Module 09: Rockets Launching! (Deployment)

This is it! Everything is built, configured, and ready to go. To put your AI on the cloud, we use the CDK CLI.

## Phase 4: Deployment
1. **Bootstrap (First time only):**
   AWS needs a "home base" for CDK files. Run this if you've never used CDK in this AWS account before:
   ```powershell
   npx cdk bootstrap
   ```

2. **Deploy Everything:**
   This command will compile your TypeScript, build your Docker image, upload it to ECR, and create all your AWS resources:
   ```powershell
   npx cdk deploy --all
   ```

## What to expect?
- You'll see a list of Security Changes (IAM policies). Type **`y`** to approve.
- You'll see "Building Docker Image..."—this might take a few minutes.
- Once finished, you'll see your **ApiUrl** and **TableName** in the terminal!

## Verification
You can test your deployment by sending a POST request to your API URL using a tool like Postman, or just a simple PowerShell command:

```powershell
$url = "YOUR_API_URL_HERE/webhook"
Invoke-RestMethod -Uri $url -Method Post -Body '{"message": "Hello"}' -ContentType "application/json"
```

### Final Achievement Unlocked! 🏆
If you get a response saying `{"message": "Hello from Serverless Agent!"}`, you have successfully built a serverless AI infrastructure!
