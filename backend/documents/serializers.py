from rest_framework import serializers

from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.CharField(source="uploaded_by_id", read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "entity_type",
            "entity_id",
            "original_name",
            "content_type",
            "size",
            "uploaded_by",
            "uploaded_at",
            "download_url",
        ]

    def get_download_url(self, obj) -> str:
        return f"/api/v1/documents/{obj.id}/download"
