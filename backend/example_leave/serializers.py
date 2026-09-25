from rest_framework import serializers

from example_leave.models import LeaveRequest


class LeaveRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequest
        fields = ["id", "employee", "reason", "status", "created_at"]
        # `employee` is never taken from the request body: it is the caller.
        read_only_fields = ["id", "employee", "status", "created_at"]
