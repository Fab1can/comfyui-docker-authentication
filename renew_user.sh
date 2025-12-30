echo "Type username:"
read username
if [ -z "$username" ]; then
    echo "Username cannot be empty"
    exit 1
fi
echo "Type password:"
read -s password
if [ -z "$password" ]; then
    echo "Password cannot be empty"
    exit 1
fi
docker run --rm -it --entrypoint htpasswd httpd:alpine -Bnb "$username" "$password" > nginx/.htpasswd