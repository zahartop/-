FROM node:20-alpine AS css
WORKDIR /build
COPY package.json tailwind.config.js ./
COPY css/input.css ./css/input.css
COPY index.html privacy.html ./
COPY js/ ./js/
RUN npm install && npm run build:css

FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY index.html privacy.html robots.txt sitemap.xml og-image.svg /usr/share/nginx/html/
COPY seo/ /usr/share/nginx/html/seo/
COPY css/custom.css css/splash.css /usr/share/nginx/html/css/
COPY --from=css /build/css/tailwind.css /usr/share/nginx/html/css/tailwind.css
COPY js/ /usr/share/nginx/html/js/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ || exit 1
