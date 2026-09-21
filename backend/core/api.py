"""Shared response shaping for endpoints whose frontend pages read
`{success, data}` with snake_case fields."""

from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response


class FrontendEnvelopeMixin:
    """employees/page.tsx, org/page.tsx, and profile/page.tsx's `fetchJson()`
    reads every response as `{success: bool, data: T}` — verified against
    that source, not assumed from docs — and expects `data` to be a bare
    array for a list, not `{results, total, page, pageSize}` (that shape
    doesn't appear anywhere in the actual frontend). Plain JSONRenderer here
    means these specific endpoints skip the project's general camelCase
    conversion too, since the frontend interfaces these pages use are
    snake_case. Both are deliberate, isolated exceptions scoped to exactly
    the viewsets these three pages call — everywhere else (auth, RBAC) keeps
    the camelCase + paginated convention, which those callers genuinely use."""

    pagination_class = None
    renderer_classes = [JSONRenderer]
    parser_classes = [JSONParser]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({"success": True, "data": serializer.data})
