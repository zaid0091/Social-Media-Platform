from rest_framework.pagination import CursorPagination
from rest_framework.response import Response
from urllib.parse import urlparse, parse_qs

class CustomCursorPagination(CursorPagination):
    page_size = 10
    ordering = '-created_at'
    cursor_query_param = 'cursor'

    def get_paginated_response(self, data):
        next_url = self.get_next_link()
        next_cursor = None
        if next_url:
            parsed = urlparse(next_url)
            next_cursor = parse_qs(parsed.query).get('cursor', [None])[0]

        return Response({
            'next': next_cursor,
            'has_next': next_cursor is not None,
            'results': data
        })
