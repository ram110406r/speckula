FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/nginx.conf

# NOTE: nginx -t resolves upstream hostnames at check time, which fails during
# Docker build because the service network doesn't exist yet. Config is still
# validated by nginx on container startup when the network is live.

EXPOSE 80
