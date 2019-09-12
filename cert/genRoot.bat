rm rootCA.crt
rm rootCA.key
rm rootCA.srl

openssl genrsa -out rootCA.key 4096
openssl req -x509 -new -nodes -key rootCA.key -subj "/C=US/ST=CA/O=intercept/CN=intercept" -sha256 -days 1024 -out rootCA.crt


