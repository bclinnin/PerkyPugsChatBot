function authMiddleware(req, res, next) {
    const adminPassword = process.env.ADMIN_PANEL_PASSWORD;
    
    if (!adminPassword) {
        return res.status(500).json({ error: 'Admin password not configured' });
    }
    
    // Check authentication from cookie or header
    const cookieAuth = req.headers.cookie?.includes(`admin_token=${adminPassword}`);
    const headerAuth = req.headers.authorization?.replace('Bearer ', '') === adminPassword;
    
    if (cookieAuth || headerAuth) {
        return next();
    }
    
    // For HTML pages, show login form
    if (req.path === '' || req.path === '/' || req.path.endsWith('.html')) {
        return res.status(401).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Admin Login</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        margin: 0;
                        background: #f5f5f5;
                    }
                    .login-box { 
                        background: white; 
                        padding: 30px; 
                        border-radius: 8px; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        width: 300px;
                    }
                    h2 { margin-top: 0; color: #333; }
                    input { 
                        width: 100%; 
                        padding: 10px; 
                        margin: 10px 0; 
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        box-sizing: border-box;
                    }
                    button { 
                        width: 100%; 
                        padding: 10px; 
                        background: #5865F2; 
                        color: white; 
                        border: none; 
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 16px;
                    }
                    button:hover { background: #4752C4; }
                    .error { color: red; margin-top: 10px; }
                </style>
            </head>
            <body>
                <div class="login-box">
                    <h2>🐶 Perky Pugs Admin</h2>
                    <form onsubmit="return login(event)">
                        <input type="password" id="password" placeholder="Admin Password" required>
                        <button type="submit">Login</button>
                        <div id="error" class="error"></div>
                    </form>
                </div>
                <script>
                    function login(e) {
                        e.preventDefault();
                        const password = document.getElementById('password').value;
                        // Store in localStorage for API calls
                        localStorage.setItem('adminToken', password);
                        // Set cookie for page authentication
                        document.cookie = 'admin_token=' + password + '; path=/; SameSite=Strict';
                        window.location.reload();
                        return false;
                    }
                </script>
            </body>
            </html>
        `);
    }
    
    // For API calls, return 401
    return res.status(401).json({ error: 'Authentication required' });
}

module.exports = authMiddleware;
