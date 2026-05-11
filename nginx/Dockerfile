FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/nginx.conf

# Validate config at build time — fails the build if nginx.conf has syntax errors
RUN nginx -t

EXPOSE 80
