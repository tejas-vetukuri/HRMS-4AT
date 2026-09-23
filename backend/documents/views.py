"""Document endpoints. Every read and write is gated by the per-entity_type
access matrix (documents/access.py) — list/upload for an entity, and a
byte-streaming download, each refused with 403 when the caller isn't allowed.
List/upload use the {success, data} envelope; download returns the raw file."""

from django.http import FileResponse
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .access import can_access
from .models import Document
from .serializers import DocumentSerializer


class DocumentListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        entity_type = request.query_params.get("entity_type")
        entity_id = request.query_params.get("entity_id")
        if not entity_type or not entity_id:
            return Response(
                {"success": False, "error": {"message": "entity_type and entity_id are required."}},
                status=400,
            )
        if not can_access(request.user, entity_type, entity_id):
            return Response({"success": False, "error": {"message": "Forbidden."}}, status=403)
        docs = Document.objects.filter(entity_type=entity_type, entity_id=entity_id)
        return Response({"success": True, "data": DocumentSerializer(docs, many=True).data})

    def post(self, request):
        entity_type = request.data.get("entity_type")
        entity_id = request.data.get("entity_id")
        upload = request.FILES.get("file")
        if not entity_type or not entity_id or upload is None:
            return Response(
                {
                    "success": False,
                    "error": {"message": "entity_type, entity_id and file are required."},
                },
                status=400,
            )
        if not can_access(request.user, entity_type, entity_id):
            return Response({"success": False, "error": {"message": "Forbidden."}}, status=403)
        document = Document.objects.create(
            entity_type=entity_type,
            entity_id=entity_id,
            file=upload,
            original_name=upload.name,
            content_type=getattr(upload, "content_type", "") or "",
            size=upload.size,
            uploaded_by=request.user,
        )
        return Response({"success": True, "data": DocumentSerializer(document).data}, status=201)


class DocumentDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        document = Document.objects.filter(pk=pk).first()
        if document is None:
            return Response({"success": False, "error": {"message": "Not found."}}, status=404)
        if not can_access(request.user, document.entity_type, document.entity_id):
            return Response({"success": False, "error": {"message": "Forbidden."}}, status=403)
        response = FileResponse(
            document.file.open("rb"), as_attachment=True, filename=document.original_name
        )
        if document.content_type:
            response["Content-Type"] = document.content_type
        return response
