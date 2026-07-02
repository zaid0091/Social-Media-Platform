import re
from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'full_name', 'bio', 
            'profile_picture', 'cover_photo', 'website', 
            'location', 'date_of_birth', 'phone_number', 
            'is_verified', 'is_private', 'account_type', 
            'follower_count', 'following_count', 'post_count',
            'created_at'
        )
        read_only_fields = ('id', 'is_verified', 'follower_count', 'following_count', 'post_count', 'created_at')

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm', 'full_name')

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value.lower()

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value.lower()

    def validate(self, data):
        # 1. Password match check
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})

        # 2. Password complexity check
        password = data['password']
        if len(password) < 8:
            raise serializers.ValidationError({"password": "Password must be at least 8 characters long."})
        if not re.search(r"[a-zA-Z]", password):
            raise serializers.ValidationError({"password": "Password must contain at least one letter."})
        if not re.search(r"\d", password):
            raise serializers.ValidationError({"password": "Password must contain at least one number."})
        if not re.search(r"[@$!%*?&#]", password):
            raise serializers.ValidationError({"password": "Password must contain at least one special character (@$!%*?&#)."})

        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data.get('full_name', ''),
            is_active=False  # Keep inactive until email is verified
        )
        return user
