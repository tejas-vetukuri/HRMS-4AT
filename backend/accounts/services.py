from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken


def revoke_all_sessions(user) -> int:
    """Blacklist every outstanding refresh token for `user`. Returns how many
    were newly revoked. Access tokens already issued live until their (short)
    expiry unless the account is also deactivated."""
    revoked = 0
    for token in OutstandingToken.objects.filter(user=user):
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        if created:
            revoked += 1
    return revoked
