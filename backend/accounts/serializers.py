from rest_framework import serializers

from accounts.models import Permission, Role, RolePermission, User, UserPermissionOverride


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "description"]


class RolePermissionSerializer(serializers.ModelSerializer):
    permission_code = serializers.CharField(source="permission.code", read_only=True)

    class Meta:
        model = RolePermission
        fields = ["id", "role", "permission", "permission_code", "scope_tier", "created_at"]
        read_only_fields = ["id", "created_at"]


class RoleSerializer(serializers.ModelSerializer):
    """`permissions` is a read-only nested view of this role's RolePermission
    rows — granting/revoking a permission on a role goes through the dedicated
    /role-permissions/ endpoint, not by PATCHing this nested list, so each write
    is one unambiguous row-level change (and one clean audit entry, since
    RoleViewSet is an AuditedModelViewSet)."""

    permissions = RolePermissionSerializer(source="role_permissions", many=True, read_only=True)

    class Meta:
        model = Role
        fields = [
            "id",
            "name",
            "archetype",
            "is_active",
            "permissions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "permissions", "created_at", "updated_at"]


class UserPermissionOverrideSerializer(serializers.ModelSerializer):
    permission_code = serializers.CharField(source="permission.code", read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = UserPermissionOverride
        fields = [
            "id",
            "user",
            "permission",
            "permission_code",
            "scope_tier",
            "is_granted",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)


class AuthUserSerializer(serializers.ModelSerializer):
    """The `user` object nested in the login response
    (docs/IMPLEMENTATION-PLAN.md): id as a string, matching the frontend's
    `User.id: string` (frontend/src/lib/auth/auth-context.tsx) even though
    the DB pk is numeric."""

    id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name"]

    def get_id(self, obj):
        return str(obj.pk)


class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name"]


class UserSerializer(serializers.ModelSerializer):
    """For UserViewSet (accounts/views.py) — user administration, primarily
    role assignment. `role` is the only writable field; email/username/names
    stay read-only here (they're set at provisioning time, not through this
    endpoint)."""

    role_name = serializers.CharField(source="role.name", read_only=True, default=None)
    employee_code = serializers.CharField(
        source="employee.employee_code", read_only=True, default=None
    )

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "role_name",
            "employee_code",
            "is_active",
        ]
        read_only_fields = ["id", "email", "first_name", "last_name", "role_name", "employee_code"]
