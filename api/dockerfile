# Use a base image that includes ffmpeg
FROM node:18-slim

# Install ffmpeg, tcpdump, ngrep
RUN apt-get update && \
    apt-get install -y ffmpeg tcpdump ngrep && \
    apt-get clean

# Set working directory
WORKDIR /app

# Copy files and install dependencies
COPY . .
RUN npm install

# Expose port
EXPOSE 3000

# Start app
CMD ["npm", "start"]
