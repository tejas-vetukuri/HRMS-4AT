from django.urls import re_path

from .views import DocumentDownloadView, DocumentListCreateView

urlpatterns = [
    re_path(r"^documents/?$", DocumentListCreateView.as_view(), name="document-list-create"),
    re_path(
        r"^documents/(?P<pk>[0-9a-fA-F-]+)/download/?$",
        DocumentDownloadView.as_view(),
        name="document-download",
    ),
]
