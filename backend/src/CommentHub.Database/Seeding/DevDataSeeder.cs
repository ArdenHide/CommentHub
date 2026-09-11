using CommentHub.Database.Entities;
using Microsoft.EntityFrameworkCore;

namespace CommentHub.Database.Seeding;

public static class DevDataSeeder
{
    private const string EmailDomain = "seed.commenthub.local";

    public static async Task SeedAsync(CommentHubDbContext dbContext, CancellationToken cancellationToken = default)
    {
        var markerEmail = $"alice@{EmailDomain}";

        if (await dbContext.Users.AnyAsync(user => user.Email == markerEmail, cancellationToken))
        {
            return;
        }

        var alice = new User { UserName = "alice", Email = markerEmail };
        var bob = new User { UserName = "bob", Email = $"bob@{EmailDomain}" };
        var carol = new User { UserName = "carol", Email = $"carol@{EmailDomain}" };
        var dave = new User { UserName = "dave", Email = $"dave@{EmailDomain}" };
        var erin = new User { UserName = "erin", Email = $"erin@{EmailDomain}" };
        dbContext.Users.AddRange(alice, bob, carol, dave, erin);
        await dbContext.SaveChangesAsync(cancellationToken);

        var baseTime = DateTimeOffset.UtcNow.AddHours(-1);
        var tick = 0;
        DateTimeOffset NextTimestamp() => baseTime.AddSeconds(tick++ * 10);

        async Task<Comment> AddRootAsync(User author, string textHtml)
        {
            var root = new Comment { User = author, TextHtml = textHtml, CreatedAt = NextTimestamp() };
            dbContext.Comments.Add(root);
            await dbContext.SaveChangesAsync(cancellationToken);
            return root;
        }

        async Task<Comment> AddReplyAsync(Comment parent, Comment root, User author, string textHtml)
        {
            var reply = new Comment
            {
                User = author,
                ParentId = parent.Id,
                RootId = root.Id,
                Depth = parent.Depth + 1,
                TextHtml = textHtml,
                CreatedAt = NextTimestamp(),
            };
            dbContext.Comments.Add(reply);
            await dbContext.SaveChangesAsync(cancellationToken);
            return reply;
        }

        await AddRootAsync(alice, "<p>Seed: комментарий без единого ответа.</p>");

        var withOneReply = await AddRootAsync(
            bob,
            "<p>Seed: комментарий с одним ответом — кнопки Show all быть не должно.</p>"
        );
        await AddReplyAsync(withOneReply, withOneReply, carol, "<p>Seed: единственный ответ.</p>");

        var withTwoReplies = await AddRootAsync(
            carol,
            "<p>Seed: комментарий с двумя ответами — должна появиться кнопка Show all (2 replies).</p>"
        );
        await AddReplyAsync(withTwoReplies, withTwoReplies, alice, "<p>Seed: первый из двух ответов.</p>");
        await AddReplyAsync(
            withTwoReplies,
            withTwoReplies,
            dave,
            "<p>Seed: второй из двух ответов (более свежий).</p>"
        );

        var withFiveReplies = await AddRootAsync(dave, "<p>Seed: комментарий с пятью ответами.</p>");
        await AddReplyAsync(withFiveReplies, withFiveReplies, alice, "<p>Seed: ответ 1 из 5.</p>");
        await AddReplyAsync(withFiveReplies, withFiveReplies, bob, "<p>Seed: ответ 2 из 5.</p>");
        await AddReplyAsync(withFiveReplies, withFiveReplies, carol, "<p>Seed: ответ 3 из 5.</p>");
        await AddReplyAsync(withFiveReplies, withFiveReplies, erin, "<p>Seed: ответ 4 из 5.</p>");
        await AddReplyAsync(withFiveReplies, withFiveReplies, alice, "<p>Seed: ответ 5 из 5 (самый свежий).</p>");

        var nestedSingle = await AddRootAsync(
            erin,
            "<p>Seed: у единственного ответа тоже только один свой ответ — "
            + "превью=1 без кнопки должно работать и на вложенном уровне.</p>"
        );
        var nestedSingleReply = await AddReplyAsync(
            nestedSingle,
            nestedSingle,
            alice,
            "<p>Seed: единственный ответ уровня 1 — у него самого один дочерний ответ.</p>"
        );
        await AddReplyAsync(nestedSingleReply, nestedSingle, bob, "<p>Seed: единственный ответ уровня 2.</p>");

        var nestedBranch = await AddRootAsync(
            alice,
            "<p>Seed: у единственного ответа — два своих ответа, кнопка Show all "
            + "должна появиться именно на вложенном уровне.</p>"
        );
        var nestedBranchReply = await AddReplyAsync(
            nestedBranch,
            nestedBranch,
            bob,
            "<p>Seed: единственный ответ уровня 1 — у него два дочерних.</p>"
        );
        await AddReplyAsync(
            nestedBranchReply,
            nestedBranch,
            carol,
            "<p>Seed: первый из двух дочерних ответов.</p>"
        );
        await AddReplyAsync(
            nestedBranchReply,
            nestedBranch,
            dave,
            "<p>Seed: второй из двух дочерних ответов (более свежий).</p>"
        );

        var deepChainRoot = await AddRootAsync(
            bob,
            "<p>Seed: глубокая цепочка — по одному ответу на уровень, шесть уровней вложенности.</p>"
        );
        var chainAuthors = new[] { carol, dave, erin, alice, bob, carol };
        var chainParent = deepChainRoot;
        for (var level = 0; level < chainAuthors.Length; level++)
        {
            chainParent = await AddReplyAsync(
                chainParent,
                deepChainRoot,
                chainAuthors[level],
                $"<p>Seed: уровень вложенности {level + 1} — всегда ровно один дочерний ответ.</p>"
            );
        }
    }
}
