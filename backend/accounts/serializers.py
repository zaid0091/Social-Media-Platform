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

class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'full_name', 'bio', 'website', 'location', 
            'date_of_birth', 'phone_number', 'is_private', 'account_type'
        )

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    new_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    new_password_confirm = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({"new_password_confirm": "New passwords do not match."})
        
        # New password complexity check
        password = data['new_password']
        if len(password) < 8:
            raise serializers.ValidationError({"new_password": "New password must be at least 8 characters long."})
        if not re.search(r"[a-zA-Z]", password):
            raise serializers.ValidationError({"new_password": "New password must contain at least one letter."})
        if not re.search(r"\d", password):
            raise serializers.ValidationError({"new_password": "New password must contain at least one number."})
        if not re.search(r"[@$!%*?&#]", password):
            raise serializers.ValidationError({"new_password": "New password must contain at least one special character (@$!%*?&#)."})

        return data

class ProfilePictureUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('profile_picture', 'cover_photo')
        extra_kwargs = {
            'profile_picture': {'required': False},
            'cover_photo': {'required': False}
        }

class UserFollowDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'full_name', 'profile_picture', 'is_verified')

from .models import Follow, FollowRequest, BlockedUser

class FollowSerializer(serializers.ModelSerializer):
    follower = UserFollowDetailsSerializer(read_only=True)
    following = UserFollowDetailsSerializer(read_only=True)

    class Meta:
        model = Follow
        fields = ('id', 'follower', 'following', 'created_at')

class FollowRequestSerializer(serializers.ModelSerializer):
    requester = UserFollowDetailsSerializer(read_only=True)
    receiver = UserFollowDetailsSerializer(read_only=True)

    class Meta:
        model = FollowRequest
        fields = ('id', 'requester', 'receiver', 'status', 'created_at')

class BlockedUserSerializer(serializers.ModelSerializer):
    blocked = UserFollowDetailsSerializer(read_only=True)

    class Meta:
        model = BlockedUser
        fields = ('id', 'blocked', 'created_at')


