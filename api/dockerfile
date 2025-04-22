# Use a base image that includes ffmpeg
FROM node:18-slim

# Install ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
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
