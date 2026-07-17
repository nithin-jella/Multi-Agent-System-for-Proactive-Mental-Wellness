from cryptography.fernet import Fernet
key = Fernet.generate_key()
print("Your new EMAIL_ENCRYPTION_KEY is:")
print(key.decode())