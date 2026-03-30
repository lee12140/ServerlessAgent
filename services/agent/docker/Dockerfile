FROM public.ecr.aws/lambda/nodejs:22 AS builder
WORKDIR /var/task
COPY package.json tsconfig.json ./
RUN npm install
COPY src/ ./src/
RUN npx tsc

FROM public.ecr.aws/lambda/nodejs:22
WORKDIR /var/task
COPY --from=builder /var/task/dist ./dist
COPY --from=builder /var/task/node_modules ./node_modules
COPY package.json ./
CMD ["dist/index.handler"]
