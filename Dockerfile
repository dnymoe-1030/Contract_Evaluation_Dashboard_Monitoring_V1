# Production Nginx Container for SM Contract Evaluation Dashboard
# Optimized for Google Cloud Run (Region: asia-southeast1 / Singapore)
FROM nginx:alpine

# Remove default static files
RUN rm -rf /usr/share/nginx/html/*

# Copy modular frontend assets
COPY index.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css/
COPY js /usr/share/nginx/html/js/
COPY data /usr/share/nginx/html/data/
COPY SM_Dashboard_Standalone.html /usr/share/nginx/html/

# Cloud Run listens on PORT 8080 by default
RUN sed -i 's/listen       80;/listen       8080;/g' /etc/nginx/conf.d/default.conf \
    && sed -i 's/listen  \[::\]:80;/listen  \[::\]:8080;/g' /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
