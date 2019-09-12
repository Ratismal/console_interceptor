rm interceptLocal.key
rm interceptLocal.csr
rm interceptLocal.crt

openssl genrsa -out interceptLocal.key 2048
openssl req -new -key interceptLocal.key -subj "/C=US/ST=CA/O=intercept/CN=intercept" -out interceptLocal.csr
openssl x509 -req -in interceptLocal.csr -CA rootCA.crt -CAkey rootCA.key -CAcreateserial -out interceptLocal.crt -days 1825 -sha256 -extfile configuration.ext
