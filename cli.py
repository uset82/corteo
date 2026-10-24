#!/usr/bin/env python3
"""
Video Editor CLI - Render projects from the command line

Usage:
    python cli.py render <project.json> [options]

Options:
    --resolution    Resolution: 720p, 1080p, or 4k (default: 1080p)
    --codec         Codec: h264 or hevc (default: h264)
    --quality       Quality: low, medium, or high (default: high)
    --output        Output file path (default: output.mp4)
"""

import sys
import os
import json
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from backend.services.renderer import VideoRenderer
from backend.models.schemas import Project

async def render_project(project_path: str, resolution: str, codec: str, quality: str, output: str):
    """Render a project file"""
    if not os.path.exists(project_path):
        print(f"Error: Project file not found: {project_path}")
        return 1
    
    with open(project_path, 'r', encoding='utf-8') as f:
        project_data = json.load(f)
        project = Project(**project_data)
    
    print(f"Rendering project: {project.name}")
    print(f"  Resolution: {resolution}")
    print(f"  Codec: {codec}")
    print(f"  Quality: {quality}")
    print(f"  Duration: {project.duration}s")
    print()
    
    renderer = VideoRenderer()
    render_jobs = {}
    render_id = "cli_render"
    
    from backend.models.schemas import RenderStatus
    from datetime import datetime
    
    render_jobs[render_id] = RenderStatus(
        id=render_id,
        project_id=project.id,
        status="queued",
        started_at=datetime.now().isoformat()
    )
    
    os.makedirs("renders", exist_ok=True)
    
    await renderer.render_project(
        render_id=render_id,
        project_id=project.id,
        resolution=resolution,
        codec=codec,
        quality=quality,
        render_jobs=render_jobs
    )
    
    status = render_jobs[render_id]
    
    if status.status == "completed":
        output_file = status.output_path.lstrip('/')
        
        if output != output_file:
            import shutil
            shutil.copy(output_file, output)
            print(f"\nRender completed: {output}")
        else:
            print(f"\nRender completed: {output_file}")
        
        return 0
    else:
        print(f"\nRender failed: {status.error}")
        return 1

def main():
    parser = argparse.ArgumentParser(description='Video Editor CLI')
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    render_parser = subparsers.add_parser('render', help='Render a project')
    render_parser.add_argument('project', help='Path to project JSON file')
    render_parser.add_argument('--resolution', default='1080p', choices=['720p', '1080p', '4k'],
                               help='Output resolution (default: 1080p)')
    render_parser.add_argument('--codec', default='h264', choices=['h264', 'hevc'],
                               help='Video codec (default: h264)')
    render_parser.add_argument('--quality', default='high', choices=['low', 'medium', 'high'],
                               help='Encoding quality (default: high)')
    render_parser.add_argument('--output', default='output.mp4',
                               help='Output file path (default: output.mp4)')
    
    args = parser.parse_args()
    
    if args.command == 'render':
        import asyncio
        exit_code = asyncio.run(render_project(
            args.project,
            args.resolution,
            args.codec,
            args.quality,
            args.output
        ))
        sys.exit(exit_code)
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == '__main__':
    main()
