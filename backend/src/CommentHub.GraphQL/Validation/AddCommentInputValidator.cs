using CommentHub.GraphQL.Services;
using CommentHub.GraphQL.Types;
using FluentValidation;

namespace CommentHub.GraphQL.Validation;

public sealed class AddCommentInputValidator : AbstractValidator<AddCommentInput>
{
    public AddCommentInputValidator(ICaptchaChallengeService captcha, IPendingAttachmentService pendingAttachments)
    {
        RuleFor(input => input.UserName)
            .NotEmpty()
            .Matches("^[A-Za-z0-9]+$")
            .WithMessage("User name may only contain Latin letters and digits.")
            .MaximumLength(64);

        RuleFor(input => input.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(320);

        RuleFor(input => input.HomePage)
            .Must(BeAnAbsoluteUrl)
            .WithMessage("Home page must be a valid URL.")
            .MaximumLength(2048)
            .When(input => !string.IsNullOrEmpty(input.HomePage));

        RuleFor(input => input.Text)
            .NotEmpty()
            .Custom(ValidateMarkup);

        RuleFor(input => input.CaptchaCode)
            .NotEmpty()
            .Must((input, code) => captcha.Validate(input.CaptchaId, code))
            .WithErrorCode("CAPTCHA_INVALID")
            .WithMessage("Captcha code is incorrect.");

        RuleFor(input => input.AttachmentToken)
            .Must(token => pendingAttachments.Get(token!) is not null)
            .WithErrorCode("ATTACHMENT_EXPIRED")
            .WithMessage("The attached file has expired or was not found. Please attach it again.")
            .When(input => !string.IsNullOrEmpty(input.AttachmentToken));
    }

    private static bool BeAnAbsoluteUrl(string? homePage)
        => Uri.TryCreate(homePage, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    private static void ValidateMarkup(string text, ValidationContext<AddCommentInput> context)
    {
        if (!CommentTextValidator.TryValidateAndSanitize(text, out _, out var error))
        {
            context.AddFailure(nameof(AddCommentInput.Text), error!);
        }
    }
}
