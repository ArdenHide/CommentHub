using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CommentHub.Database.Migrations
{
    /// <inheritdoc />
    public partial class AddParentIdRepliesIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Comments_ParentId",
                table: "Comments");

            migrationBuilder.DropIndex(
                name: "IX_Comments_RootId_Id",
                table: "Comments");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_Replies_ParentId_CreatedAt_Id",
                table: "Comments",
                columns: new[] { "ParentId", "CreatedAt", "Id" },
                filter: " \"ParentId\" IS NOT NULL ");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_RootId",
                table: "Comments",
                column: "RootId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Comments_Replies_ParentId_CreatedAt_Id",
                table: "Comments");

            migrationBuilder.DropIndex(
                name: "IX_Comments_RootId",
                table: "Comments");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_ParentId",
                table: "Comments",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_RootId_Id",
                table: "Comments",
                columns: new[] { "RootId", "Id" });
        }
    }
}
