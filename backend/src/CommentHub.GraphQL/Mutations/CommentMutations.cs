using CommentHub.Database;
using CommentHub.Database.Entities;
using CommentHub.GraphQL.Types;
using CommentHub.GraphQL.Validation;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace CommentHub.GraphQL.Mutations;

[MutationType]
public static partial class CommentMutations
{
    public static async Task<AddCommentPayload> AddCommentAsync(
        AddCommentInput input,
        CommentHubDbContext dbContext,
        IValidator<AddCommentInput> validator,
        CancellationToken cancellationToken
    )
    {
        var validationResult = await validator.ValidateAsync(input, cancellationToken);
        if (!validationResult.IsValid)
        {
            return new AddCommentPayload(null, MapErrors(validationResult.Errors));
        }

        long? rootId = null;
        var depth = 0;

        if (input.ParentId is { } parentId)
        {
            var parent = await dbContext.Comments
                .Where(comment => comment.Id == parentId)
                .Select(comment => new { comment.Id, comment.RootId, comment.Depth })
                .FirstOrDefaultAsync(cancellationToken);

            if (parent is null)
            {
                var error = new UserError(ToCamelCase(nameof(AddCommentInput.ParentId)), "NOT_FOUND", $"Comment {parentId} does not exist.");
                return new AddCommentPayload(null, [error]);
            }

            rootId = parent.RootId ?? parent.Id;
            depth = parent.Depth + 1;
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == input.Email, cancellationToken);
        if (user is null)
        {
            user = new User
            {
                UserName = input.UserName,
                Email = input.Email,
                HomePage = input.HomePage,
                CreatedAt = DateTimeOffset.UtcNow,
            };
            dbContext.Users.Add(user);
        }

        CommentTextValidator.TryValidateAndSanitize(input.Text, out var sanitizedHtml, out _);

        var comment = new Comment
        {
            User = user,
            ParentId = input.ParentId,
            RootId = rootId,
            Depth = depth,
            TextHtml = sanitizedHtml,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        dbContext.Comments.Add(comment);

        await dbContext.SaveChangesAsync(cancellationToken);

        return new AddCommentPayload(comment, []);
    }

    private static IReadOnlyList<UserError> MapErrors(IEnumerable<FluentValidation.Results.ValidationFailure> failures)
        => failures
            .Select(failure => new UserError(
                ToCamelCase(failure.PropertyName),
                string.IsNullOrEmpty(failure.ErrorCode) ? "VALIDATION_ERROR" : failure.ErrorCode,
                failure.ErrorMessage))
            .ToArray();

    private static string ToCamelCase(string propertyName)
        => propertyName.Length == 0 ? propertyName : char.ToLowerInvariant(propertyName[0]) + propertyName[1..];
}
