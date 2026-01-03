## New app module + Portfolio wiring (exact order)

### 1. Standalone repo (create + push first)

- On GitHub: create `<GitHubUserOrOrg>/<NewProjectName>` **without** README/license/gitignore.

```bash
cd <PortfolioParentFolder>
git clone https://github.com/<GitHubUserOrOrg>/<NewProjectName>.git
cd <NewProjectName>

dotnet new razorclasslib -n <NewProjectName>.Web
```

- In `<NewProjectName>.Web/<NewProjectName>.Web.csproj`:
  - `Sdk="Microsoft.NET.Sdk.Razor"`
  - `<StaticWebAssetBasePath>apps/<lowercase-name></StaticWebAssetBasePath>`

```bash
git add .
git commit -m "Initial <NewProjectName>.Web scaffold"
git push -u origin main
```

### 2. Minimal ASP.NET glue

- Controller in `<NewProjectName>.Web/Controllers`:
  - Namespace: `<NewProjectName>.Web.Controllers`
  - Route: `[HttpGet("/<lowercase-route>")]` (e.g. `/webamp`)
  - `ViewData["IsAppPage"] = true;`
  - `return View("~/Apps/<NewProjectName>/Views/Index.cshtml");`
- Views under `<NewProjectName>.Web/Apps/<NewProjectName>/Views/`:
  - `_ViewImports.cshtml` → `@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers`
  - `_ViewStart.cshtml` → `Layout = "_Layout";`
  - `Index.cshtml` → app landing page.
- Optional: `wwwroot/ts/*.ts`, `wwwroot/css/apps/*.css`, esbuild target (copy from `NameTrace.Web` / `WebAmp.Web`).

### 3. Add as submodule in Portfolio (GitHub URL)

From Portfolio root:

```bash
cd <PortfolioRepoRoot>

git submodule add https://github.com/<GitHubUserOrOrg>/<NewProjectName>.git Submodules/<NewProjectName>
git submodule update --init --recursive

cd Submodules/<NewProjectName>
git config pull.rebase true
```


### 4. Wire into Portfolio

In `Portfolio.csproj` add:

```xml
<ProjectReference Include="Submodules/<NewProjectName>/<NewProjectName>.Web/<NewProjectName>.Web.csproj" />
```

In `Program.cs` add:

```csharp
.AddApplicationPart(typeof(<NewProjectName>.Web.Controllers.<YourControllerName>).Assembly)
```

Map the landing route:

```csharp
app.MapControllerRoute(
    name: "<lowercase-route>",
    pattern: "/<lowercase-route>",
    defaults: new { controller = "<YourControllerNameWithoutSuffix>", action = "Index" });
```

### 5. Add Projects tile

In `wwwroot/assets/projects/manifest.json` add:

```json
{
  "slug": "<lowercase-route>",
  "title": "<NewProjectName>",
  "tag": "Web",
  "footer": ".NET Core, TypeScript",
  "gradientAngle": 210,
  "gradientColor1": "#241c34",
  "gradientColor2": "#0b1020",
  "span": "1x1",
  "url": "/<lowercase-route>",
  "external": false,
  "component": null
}
```

### 6. Build + check

From Portfolio root:

```bash
dotnet build
```

Run dev setup and visit:
- `http://localhost:8081/<lowercase-route>`
- Projects view → confirm tile + navigation.

### Notes (when Git fights you)

- If first push says **fetch first**:

```bash
git pull --rebase origin main
git push -u origin main
```

- Avoid local-path submodules. Use the GitHub URL so VS Code + submodule pulls work normally.
