"""One error shape for the whole API.

Every error response, whether it came from authentication, a permission check,
validation, a missing object or a throttle, is:

    {"success": false,
     "error": {"code": "FORBIDDEN", "message": "...", "fields": {...}}}

This is the shape the auth endpoints already return and the frontend proxy
reads, so a module author never has to think about it: raise a DRF exception
and it comes out right. `fields` is only populated for validation errors.
"""

from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.views import exception_handler as drf_exception_handler


class Conflict(exceptions.APIException):
    """The request is valid but clashes with the current state (HTTP 409), for
    example deleting something that is still in use."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This conflicts with the current state of the data."
    default_code = "conflict"


_CODES = (
    (Conflict, "CONFLICT"),
    (exceptions.NotAuthenticated, "UNAUTHENTICATED"),
    (exceptions.AuthenticationFailed, "UNAUTHENTICATED"),
    (exceptions.PermissionDenied, "FORBIDDEN"),
    (exceptions.NotFound, "NOT_FOUND"),
    (Http404, "NOT_FOUND"),
    (exceptions.ValidationError, "VALIDATION_ERROR"),
    (exceptions.MethodNotAllowed, "METHOD_NOT_ALLOWED"),
    (exceptions.Throttled, "THROTTLED"),
    (exceptions.ParseError, "BAD_REQUEST"),
    (exceptions.UnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE"),
    (exceptions.NotAcceptable, "NOT_ACCEPTABLE"),
)


def _code_for(exc, http_status):
    for exc_class, code in _CODES:
        if isinstance(exc, exc_class):
            return code
    return "ERROR" if http_status < 500 else "SERVER_ERROR"


def _message_for(exc, data):
    if isinstance(exc, exceptions.ValidationError):
        return "Some fields are invalid."
    if isinstance(data, dict) and "detail" in data:
        return str(data["detail"])
    return str(exc)


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None  # not an API error: let Django produce its own 500

    fields = {}
    if isinstance(exc, exceptions.ValidationError):
        data = response.data
        fields = data if isinstance(data, dict) else {"nonFieldErrors": data}

    response.data = {
        "success": False,
        "error": {
            "code": _code_for(exc, response.status_code),
            "message": _message_for(exc, response.data),
            "fields": fields,
        },
    }
    if response.status_code == status.HTTP_401_UNAUTHORIZED:
        response.data["error"]["code"] = "UNAUTHENTICATED"
    return response
