This was generated by following the following guide: http://www.akadia.com/services/ssh_test_certificate.html

The key to the original key (server.key.org) is 1234

If the certificate runs out, use the following command:
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt