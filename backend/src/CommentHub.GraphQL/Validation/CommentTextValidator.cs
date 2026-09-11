using System.Xml;
using System.Xml.Linq;
using Ganss.Xss;

namespace CommentHub.GraphQL.Validation;

/// <summary>
/// Enforces the comment markup contract: only <c>&lt;a href title&gt;</c>, <c>&lt;code&gt;</c>,
/// <c>&lt;i&gt;</c> and <c>&lt;strong&gt;</c> are allowed, and the fragment must be well-formed
/// XHTML (every tag closed and properly nested). Invalid markup is rejected, never rewritten.
/// </summary>
public static class CommentTextValidator
{
    private static readonly HashSet<string> AllowedTags = ["a", "code", "i", "strong"];
    private static readonly HashSet<string> AllowedLinkAttributes = ["href", "title"];
    private static readonly HashSet<string> AllowedSchemes = ["http", "https", "mailto"];

    /// <summary>
    /// Attributes the sanitizer may see on output. Includes <c>rel</c>, which
    /// <see cref="AddNofollowToLinks"/> stamps onto every link after validation — <c>rel</c> is
    /// never accepted from user input (it's absent from <see cref="AllowedLinkAttributes"/>), so a
    /// submitted value can never survive validation to be overwritten here.
    /// </summary>
    private static readonly HashSet<string> AllowedOutputLinkAttributes = [.. AllowedLinkAttributes, "rel"];

    private static readonly string AllowedTagsList = string.Join(", ", AllowedTags);
    private static readonly string AllowedSchemesList = string.Join(", ", AllowedSchemes);

    /// <summary>Every link is untrusted, user-submitted content: it carries no SEO weight for us.</summary>
    private const string LinkRel = "nofollow ugc";

    public static bool TryValidateAndSanitize(string text, out string sanitizedHtml, out string? error)
    {
        sanitizedHtml = string.Empty;

        if (!TryParseWellFormed(text, out var root, out error))
        {
            return false;
        }

        if (!TryValidateWhitelist(root, out error))
        {
            return false;
        }

        AddNofollowToLinks(root);

        return TrySanitize(SerializeChildren(root), out sanitizedHtml, out error);
    }

    private static bool TryParseWellFormed(string text, out XElement root, out string? error)
    {
        root = null!;

        try
        {
            root = XElement.Parse($"<root>{text}</root>", LoadOptions.PreserveWhitespace);
            error = null;
            return true;
        }
        catch (XmlException ex)
        {
            error = $"Text must be well-formed XHTML (every tag closed and properly nested): {ex.Message}";
            return false;
        }
    }

    private static bool TryValidateWhitelist(XElement root, out string? error)
    {
        foreach (var element in root.Descendants())
        {
            var tagName = element.Name.LocalName;

            if (!AllowedTags.Contains(tagName))
            {
                error = $"Tag <{tagName}> is not allowed. Allowed tags: {AllowedTagsList}.";
                return false;
            }

            var allowedAttributes = tagName == "a" ? AllowedLinkAttributes : [];
            foreach (var attribute in element.Attributes())
            {
                if (!allowedAttributes.Contains(attribute.Name.LocalName))
                {
                    error = $"Attribute \"{attribute.Name.LocalName}\" is not allowed on <{tagName}>.";
                    return false;
                }
            }

            if (!element.Nodes().Any())
            {
                error = $"<{tagName}> cannot be empty.";
                return false;
            }

            if (tagName == "a")
            {
                var href = element.Attribute("href")?.Value;
                if (!string.IsNullOrEmpty(href) && !HasAllowedScheme(href))
                {
                    error = $"Link href must use one of: {AllowedSchemesList}.";
                    return false;
                }
            }
        }

        error = null;
        return true;
    }

    private static bool HasAllowedScheme(string href)
        => Uri.TryCreate(href, UriKind.Absolute, out var uri) && AllowedSchemes.Contains(uri.Scheme);

    private static void AddNofollowToLinks(XElement root)
    {
        foreach (var link in root.Descendants("a"))
        {
            link.SetAttributeValue("rel", LinkRel);
        }
    }

    private static string SerializeChildren(XElement root)
    {
        using var writer = new StringWriter();
        using var xmlWriter = XmlWriter.Create(writer, new XmlWriterSettings
        {
            OmitXmlDeclaration = true,
            ConformanceLevel = ConformanceLevel.Fragment,
            Indent = false,
        });

        foreach (var node in root.Nodes())
        {
            node.WriteTo(xmlWriter);
        }

        xmlWriter.Flush();
        return writer.ToString();
    }

    /// <summary>
    /// Defense in depth: sanitizes the already-validated markup with the same whitelist through
    /// a dedicated library. If it still removes anything, the input is treated as invalid rather
    /// than silently emitting a weaker version of it.
    /// </summary>
    private static bool TrySanitize(string text, out string sanitizedHtml, out string? error)
    {
        var sanitizer = new HtmlSanitizer();
        sanitizer.AllowedTags.Clear();
        sanitizer.AllowedTags.UnionWith(AllowedTags);
        sanitizer.AllowedAttributes.Clear();
        sanitizer.AllowedAttributes.UnionWith(AllowedOutputLinkAttributes);
        sanitizer.AllowedSchemes.Clear();
        sanitizer.AllowedSchemes.UnionWith(AllowedSchemes);
        sanitizer.AllowedCssProperties.Clear();
        sanitizer.AllowDataAttributes = false;

        var wasModified = false;
        sanitizer.RemovingTag += (_, _) => wasModified = true;
        sanitizer.RemovingAttribute += (_, _) => wasModified = true;

        var sanitized = sanitizer.Sanitize(text);

        if (wasModified)
        {
            sanitizedHtml = string.Empty;
            error = "Text failed sanitization. Please remove any unsupported markup.";
            return false;
        }

        sanitizedHtml = sanitized;
        error = null;
        return true;
    }
}
