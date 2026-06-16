class AuditMiddleware:
    """
    Middleware that extracts client IP (handling reverse proxies) and User Agent
    and attaches them to the request object for easy auditing access.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Try to extract the real client IP behind reverse proxies/CDNs
        ip = '0.0.0.0'
        
        # Priority list of headers commonly used by reverse proxies, CDN networks, and load balancers
        headers_to_check = [
            'HTTP_CF_CONNECTING_IP',  # Cloudflare
            'HTTP_X_REAL_IP',         # Nginx, Traefik, etc.
            'HTTP_X_FORWARDED_FOR',   # Standard proxy header
            'HTTP_CLIENT_IP',         # Web servers/proxies
            'HTTP_X_ORIGINAL_FOR',    # IIS/ARR and other proxies
        ]
        
        for header in headers_to_check:
            val = request.META.get(header)
            if val:
                # HTTP_X_FORWARDED_FOR can contain a list of IPs: "client, proxy1, proxy2"
                if header == 'HTTP_X_FORWARDED_FOR':
                    ip = val.split(',')[0].strip()
                else:
                    ip = val.strip()
                break
        else:
            # Fallback to direct REMOTE_ADDR
            ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
            
        request.client_ip = ip
        request.user_agent = request.META.get('HTTP_USER_AGENT', 'unknown')[:512]

        response = self.get_response(request)
        return response
