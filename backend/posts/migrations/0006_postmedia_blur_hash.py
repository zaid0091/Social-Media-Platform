from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0005_post_repost_count_post_repost_of_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='postmedia',
            name='blur_hash',
            field=models.TextField(blank=True, null=True),
        ),
    ]
