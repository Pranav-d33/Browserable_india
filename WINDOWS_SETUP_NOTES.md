# Windows Setup Notes

## SQLite Installation Issue

On Windows, the `better-sqlite3` package requires Visual Studio build tools to compile native code. If you encounter build errors, here are the solutions:

### Option 1: Install Visual Studio Build Tools (Recommended)

1. **Download Visual Studio Build Tools**:
   - Visit: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
   - Download "Build Tools for Visual Studio 2022"

2. **Install with C++ Workload**:
   - Run the installer
   - Select "Desktop development with C++"
   - Install

3. **Retry Installation**:
   ```bash
   pnpm install
   ```

### Option 2: Use Pre-built Binaries (Alternative)

If you can't install Visual Studio, you can use a pre-built SQLite alternative:

```bash
# Remove better-sqlite3
pnpm remove better-sqlite3 @types/better-sqlite3

# Install sqlite3 (pre-built)
pnpm add sqlite3 @types/sqlite3
```

Then update the SQLite adapter to use the `sqlite3` package instead.

### Option 3: Use WSL (Windows Subsystem for Linux)

1. **Install WSL**:

   ```powershell
   wsl --install
   ```

2. **Use Linux Environment**:
   ```bash
   wsl
   cd /mnt/c/Users/ujwal_mahajan/Documents/startup
   ./scripts/setup-local-dev.sh
   ```

### Option 4: Skip SQLite for Now

You can still test the other components:

```bash
# Install without SQLite
pnpm install --ignore-scripts

# Test Gemini integration
GEMINI_API_KEY=your_key pnpm --filter @bharat-agents/tasks dev
```

## Alternative Database Options

If SQLite continues to be problematic on Windows, consider:

1. **Use PostgreSQL locally**:
   - Install PostgreSQL for Windows
   - Use Docker for PostgreSQL
   - Use a cloud PostgreSQL service

2. **Use SQLite WebAssembly**:
   - Use `sql.js` for browser-based SQLite
   - Use `@sqlite.org/sqlite-wasm` for Node.js

## Quick Test Without SQLite

To test the Gemini integration without database setup:

```bash
# Set environment variables
$env:GEMINI_API_KEY="your_key_here"
$env:USE_SQLITE="false"
$env:USE_LOCAL_STORAGE="true"

# Start with mock database
pnpm --filter @bharat-agents/tasks dev
```

## Success Indicators

✅ **Gemini API working**: LLM responses received  
✅ **Local file storage**: Files saved to uploads/ directory  
✅ **Environment detection**: Correct services selected  
✅ **Security features**: Input validation working

---

**Note**: The core functionality (Gemini LLM, local storage, security) works independently of the database choice. You can develop and test most features even without SQLite.
