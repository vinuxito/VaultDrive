# Step 2: DNS Wildcard Routing Configuration

This step details the setup of wildcard subdomains for `*.uappgenerator.filemonprime.net`. This allows dynamically generated applications to be served instantly at their own subdomains without requiring manual Apache reloads or DNS updates.

---

## 🎯 Goal
Configure the Apache web server and mod_rewrite rules to map any subdomain `app-slug.uappgenerator.filemonprime.net` dynamically to the corresponding target directory under `/lamp/www/uappgenerator/storage/deployments/app-slug/`.

---

## 🏗️ Apache Wildcard Vhost Mapping

Update the staging Apache configuration file at `/lamp/apache2/conf/extra/uappgenerator-ssl.conf` with the following virtual host block:

```apache
<IfFile "/etc/letsencrypt/live/uappgenerator.filemonprime.net/fullchain.pem">
<VirtualHost *:443>
    ServerName uappgenerator.filemonprime.net
    ServerAlias *.uappgenerator.filemonprime.net

    # Document Root points to the generator's public panel
    DocumentRoot "/lamp/www/uappgenerator/public"

    # Directory for deployed applications (aliases /deployments for assets paths)
    Alias /deployments "/lamp/www/uappgenerator/storage/deployments"
    
    <Directory "/lamp/www/uappgenerator/storage/deployments">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Dynamic subdomains rewrite mapping
    RewriteEngine On
    
    # 1. Skip rewrites if requesting the main panel domain
    RewriteCond %{HTTP_HOST} !^uappgenerator\.filemonprime\.net$ [NC]
    RewriteCond %{ENV:REDIRECT_STATUS} ^$
    
    # 2. Match the subdomain token and rewrite to the deployments directory
    RewriteCond %{HTTP_HOST} ^([a-z0-9_-]+)\.uappgenerator\.filemonprime\.net$ [NC]
    RewriteRule ^(.*)$ /lamp/www/uappgenerator/storage/deployments/%1$1 [L]

    # SSL Certs (Let's Encrypt Wildcard Certificate)
    SSLEngine on
    SSLCertificateFile "/etc/letsencrypt/live/uappgenerator.filemonprime.net/fullchain.pem"
    SSLCertificateKeyFile "/etc/letsencrypt/live/uappgenerator.filemonprime.net/privkey.pem"
</VirtualHost>
</IfFile>
```

---

## ⚙️ Wildcard SSL Certificate Renewal

Since HTTP-01 challenges cannot renew wildcard certificates (`*.uappgenerator.filemonprime.net`), we utilize Certbot's DNS-01 challenge or multi-domain naming:
- If DNS API access is integrated, renew the wildcard certificate:
  ```bash
  sudo certbot certonly --manual --preferred-challenges dns -d uappgenerator.filemonprime.net -d *.uappgenerator.filemonprime.net
  ```
- Alternatively, include specific active preview subdomains explicitly in a unified SAN certificate.

---

## 🧪 Verification Plan
- Validate Apache syntax before reloading:
  ```bash
  sudo /lamp/apache2/bin/apachectl configtest
  ```
- Reload Apache:
  ```bash
  sudo systemctl reload apache
  ```
- Test resolution using `curl` with host header mapping:
  ```bash
  curl -H "Host: e2e-league.uappgenerator.filemonprime.net" -i https://uappgenerator.filemonprime.net/
  ```
- Assert it correctly rewrites to serve the dynamic app index.
