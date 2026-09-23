from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class ContractPageNumberPagination(PageNumberPagination):
    """Matches the frontend's pagination shape exactly (docs/IMPLEMENTATION-PLAN.md):
    {results: [...], total: N, page: N, pageSize: N}. camelCase here is literal,
    not auto-converted — this is the top-level envelope, not a model field."""

    page_size = 20
    page_size_query_param = "pageSize"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(
            {
                "results": data,
                "total": self.page.paginator.count,
                "page": self.page.number,
                "pageSize": self.get_page_size(self.request),
            }
        )
