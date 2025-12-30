#controlla che esista il file nginx/.htpasswd e che non sia vuoto
if [ ! -s nginx/.htpasswd ]; then
    echo "Error: nginx/.htpasswd does not exist or is empty. Please initialize the user credentials first with renew_user.sh"
    exit 1
fi