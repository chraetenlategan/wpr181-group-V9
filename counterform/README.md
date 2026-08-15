# Counterform

A dark, minimalist, fullscreen-per-page portfolio site.

### Fictional client

| | |
| ---: | --- |
| **Studio** | Counterform |
| **Founder** | Elliot Shaw |
| **Role** | Type designer & letterer |
| **Based in** | South Africa, Western Cape |
| **Founded** | 2024 |
| **What they do** | A one person type foundry designing custom and retail typefaces for editorial, branding and identity work. Formerly a letterpress apprentice before moving into digital type design. |
| **Typefaces** | Marrow, Solder, Vellum, Nettle, Ferrule, Husk |

### File structure

```c++
counterform/
|---'index.html'          // Home
|---'about.html'          // About
|---'porfolio.html'       // Portfolio
|---'contact.html'        // Contact
|---css/
|   |---'style.css'       // Shared styles across all pages
|---js/
|   |---'main.js'         // Extra functionality that may be needed later
```

### Color palette

| Color | ㅤㅤㅤㅤㅤㅤㅤㅤ |
| :--- | :--- |
| **Background** | <span style="display:block; background-color: #0b0b0a; height:20px; width:100%;"></span> |
| **Background Alternative** | <span style="display:block; background-color: #131210; height:20px; width:100%;"></span> |
| **Background Raised** | <span style="display:block; background-color: #1a1815; height:20px; width:100%;"></span> |
| **Ink** | <span style="display:block; background-color: #f2ede1; height:20px; width:100%;"></span> |
| **Ink Dim** | <span style="display:block; background-color: #9c9587; height:20px; width:100%;"></span> |
| **Ink Faint** | <span style="display:block; background-color: #58534a; height:20px; width:100%;"></span> |
| **Brass** | <span style="display:block; background-color: #c9a961; height:20px; width:100%;"></span> |
| **Brass Dim** | <span style="display:block; background-color: #8a7642; height:20px; width:100%;"></span> |
| **Rust** | <span style="display:block; background-color: #a35237; height:20px; width:100%;"></span> |
| **Rule** | <span style="display:block; background-color: #262420; height:20px; width:100%;"></span> |
| **Rule Soft** | <span style="display:block; background-color: #1c1a17; height:20px; width:100%;"></span> |

### Notes

> - No page scrolls - every page is going to be sized to exactly one viewport ('100vh').
> - No images - all visuals are typographic, CSS, or inline SVGs.
> - All class names should follow [BEM](https://getbem.com/naming/) (`block__element`, `block--modifier`)
